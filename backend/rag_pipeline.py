import os
import hashlib
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain.chains import RetrievalQA

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
CHROMA_DIR = os.getenv("CHROMA_DIR", "chroma_db")

# FastEmbed — lightweight local embeddings, no API key needed
embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")

# ── Per-user vector store cache ────────────────────────────────────────────────
# Maps user_email → Chroma instance so we don't recreate connections on every call
_user_stores: dict = {}

# Per-user answer cache: (user_email, question_hash) → answer dict
_answer_cache: dict = {}


def _collection_name(user_email: str) -> str:
    """Generate a safe, unique ChromaDB collection name from a user's email."""
    return "user_" + hashlib.md5(user_email.encode()).hexdigest()[:16]


def get_user_vectorstore(user_email: str) -> Chroma:
    """Return the Chroma collection for this user, creating it if needed."""
    if user_email not in _user_stores:
        _user_stores[user_email] = Chroma(
            collection_name=_collection_name(user_email),
            embedding_function=embeddings,
            persist_directory=CHROMA_DIR,
        )
    return _user_stores[user_email]


def _hash(text: str) -> str:
    return hashlib.md5(text.lower().strip().encode()).hexdigest()


# ── Multi-format document loader ───────────────────────────────────────────────

def _load_pptx(file_path: str) -> list:
    """Extract text from a PowerPoint file slide-by-slide."""
    from pptx import Presentation
    from langchain_core.documents import Document

    prs = Presentation(file_path)
    docs = []
    for i, slide in enumerate(prs.slides):
        texts = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                texts.append(shape.text.strip())
        if texts:
            docs.append(Document(
                page_content="\n".join(texts),
                metadata={"source": file_path, "page": i, "slide": i + 1},
            ))
    return docs


def load_document(file_path: str) -> list:
    """
    Load a document based on its file extension.
    Supported: .pdf, .docx, .pptx, .txt
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return PyPDFLoader(file_path).load()

    elif ext == ".txt":
        return TextLoader(file_path, encoding="utf-8").load()

    elif ext == ".docx":
        from langchain_community.document_loaders import Docx2txtLoader
        return Docx2txtLoader(file_path).load()

    elif ext == ".pptx":
        return _load_pptx(file_path)

    else:
        raise ValueError(f"Unsupported file type: {ext}. Supported: .pdf .docx .pptx .txt")


# ── Core pipeline functions ────────────────────────────────────────────────────

def list_indexed_files(user_email: str) -> list:
    """Return unique filenames indexed in this user's collection."""
    try:
        vs = get_user_vectorstore(user_email)
        results = vs.get(include=["metadatas"])
        files = set()
        for meta in results.get("metadatas", []):
            src = meta.get("source", "")
            if src:
                files.add(os.path.basename(src))
        return sorted(list(files))
    except Exception:
        return []


def clear_vectorstore(user_email: str):
    """Delete all documents from this user's vector collection."""
    global _user_stores
    # Clear this user's answer cache
    keys_to_del = [k for k in _answer_cache if k[0] == user_email]
    for k in keys_to_del:
        del _answer_cache[k]

    try:
        vs = get_user_vectorstore(user_email)
        vs.delete_collection()
        # Remove from cache so it gets recreated fresh on next access
        _user_stores.pop(user_email, None)
    except Exception:
        pass


def ingest_document(file_path: str, user_email: str) -> int:
    """
    Load any supported document, split into chunks, and store in the
    user's private ChromaDB collection. Returns the number of chunks indexed.
    """
    pages = load_document(file_path)

    # Larger overlap (100) reduces context loss at chunk boundaries
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
    chunks = splitter.split_documents(pages)

    vs = get_user_vectorstore(user_email)
    vs.add_documents(chunks)

    # Invalidate this user's answer cache when new content is added
    keys_to_del = [k for k in _answer_cache if k[0] == user_email]
    for k in keys_to_del:
        del _answer_cache[k]

    return len(chunks)


# Keep old name as an alias so nothing outside this module needs to change yet
def ingest_pdf(file_path: str, user_email: str) -> int:
    return ingest_document(file_path, user_email)


def get_answer(question: str, user_email: str) -> dict:
    """Retrieve relevant chunks from the user's collection and answer with page citations."""

    # Return cached answer for this user + question combo
    cache_key = (user_email, _hash(question))
    if cache_key in _answer_cache:
        return {**_answer_cache[cache_key], "cached": True}

    vs = get_user_vectorstore(user_email)
    retriever = vs.as_retriever(
        search_type="mmr",          # MMR: diverse results, avoids redundant chunks
        search_kwargs={"k": 6, "fetch_k": 12},
    )

    llm = ChatGroq(api_key=GROQ_API_KEY, model="llama-3.1-8b-instant", temperature=0)

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        return_source_documents=True,
    )

    result = qa_chain.invoke({"query": question})

    # Build source info: page number + snippet of the chunk text
    sources = []
    seen_pages = set()
    for doc in result["source_documents"]:
        page = doc.metadata.get("page", 0) + 1
        filename = os.path.basename(doc.metadata.get("source", "unknown"))
        if page not in seen_pages:
            seen_pages.add(page)
            sources.append({
                "page": page,
                "file": filename,
                "snippet": doc.page_content[:200].strip(),
            })

    answer = {
        "answer": result["result"],
        "sources": sources,
        "cached": False,
    }

    # Cache up to 200 answers per user (prevent unbounded growth)
    user_cache_keys = [k for k in _answer_cache if k[0] == user_email]
    if len(user_cache_keys) > 200:
        for k in user_cache_keys[:50]:   # evict oldest 50
            del _answer_cache[k]
    _answer_cache[cache_key] = answer

    return answer


def get_top_chunks(user_email: str, k: int = 8) -> str:
    """
    Retrieve the most semantically diverse chunks for this user's notes.
    Used by quiz.py and study-guide endpoint.
    """
    vs = get_user_vectorstore(user_email)
    retriever = vs.as_retriever(
        search_type="mmr",
        search_kwargs={"k": k, "fetch_k": 16},
    )
    docs = retriever.invoke("key concepts, definitions, important facts and examples")
    return "\n\n".join(doc.page_content for doc in docs)
