import os
import time
import hashlib
from functools import lru_cache
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain.chains import RetrievalQA

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
CHROMA_DIR = os.getenv("CHROMA_DIR", "chroma_db")

# FastEmbed — lightweight local embeddings, low RAM, no API key needed
embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")

vectorstore = Chroma(
    collection_name="lecture_notes",
    embedding_function=embeddings,
    persist_directory=CHROMA_DIR,
)

# Simple in-memory cache: question hash → answer dict
# Prevents duplicate Groq calls for the same question
_answer_cache: dict = {}


def _hash(text: str) -> str:
    return hashlib.md5(text.lower().strip().encode()).hexdigest()


def list_indexed_files() -> list:
    """Return unique filenames that have been indexed."""
    try:
        results = vectorstore.get(include=["metadatas"])
        files = set()
        for meta in results.get("metadatas", []):
            src = meta.get("source", "")
            if src:
                files.add(os.path.basename(src))
        return sorted(list(files))
    except Exception:
        return []


def clear_vectorstore():
    """Delete all documents from the vector store."""
    global vectorstore
    _answer_cache.clear()  # also clear answer cache on reset
    try:
        vectorstore.delete_collection()
        vectorstore = Chroma(
            collection_name="lecture_notes",
            embedding_function=embeddings,
            persist_directory=CHROMA_DIR,
        )
    except Exception:
        pass


def ingest_pdf(file_path: str) -> int:
    """Load a PDF, split into chunks, store embeddings in ChromaDB."""
    loader = PyPDFLoader(file_path)
    pages = loader.load()

    # Larger overlap (100) reduces context loss at chunk boundaries
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
    chunks = splitter.split_documents(pages)

    vectorstore.add_documents(chunks)
    _answer_cache.clear()  # invalidate cache when new content is added
    return len(chunks)


def get_answer(question: str) -> dict:
    """Retrieve relevant chunks and answer with page citations + source text."""

    # Return cached answer if same question was asked before
    cache_key = _hash(question)
    if cache_key in _answer_cache:
        return {**_answer_cache[cache_key], "cached": True}

    # Retrieve k=6 chunks (up from 4) for better coverage
    retriever = vectorstore.as_retriever(
        search_type="mmr",  # MMR: diverse results, avoids redundant chunks
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

    # Cache for 1 hour (simple dict — fine for single-instance deployment)
    if len(_answer_cache) > 200:
        _answer_cache.clear()  # prevent unbounded growth
    _answer_cache[cache_key] = answer

    return answer


def get_top_chunks(k: int = 8) -> str:
    """Used by quiz.py — increased k=8 for better quiz coverage."""
    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": k, "fetch_k": 16},
    )
    docs = retriever.invoke("key concepts, definitions, important facts and examples")
    return "\n\n".join(doc.page_content for doc in docs)
