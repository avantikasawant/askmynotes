import os
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain.chains import RetrievalQA

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
CHROMA_DIR = os.getenv("CHROMA_DIR", "chroma_db")

# Local embedding model — runs on CPU, completely free, no API key needed
embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
vectorstore = Chroma(
    collection_name="lecture_notes",
    embedding_function=embeddings,
    persist_directory=CHROMA_DIR,
)

# Track filenames in a simple set stored as Chroma metadata
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
    try:
        vectorstore.delete_collection()
        
        # Recreate empty collection so the app stays usable
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

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_documents(pages)

    vectorstore.add_documents(chunks)
    return len(chunks)


def get_answer(question: str) -> dict:
    """Retrieve relevant chunks and answer with page citations + source text."""
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

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
        page = doc.metadata.get("page", 0) + 1  # 0-indexed → 1-indexed
        filename = os.path.basename(doc.metadata.get("source", "unknown"))
        if page not in seen_pages:
            seen_pages.add(page)
            sources.append({
                "page": page,
                "file": filename,
                "snippet": doc.page_content[:200].strip(),  # first 200 chars of chunk
            })

    return {
        "answer": result["result"],
        "sources": sources,
    }


def get_top_chunks(k: int = 6) -> str:
    """Used by quiz.py to pull representative content for question generation."""
    retriever = vectorstore.as_retriever(search_kwargs={"k": k})
    docs = retriever.invoke("key concepts, definitions, and important facts")
    return "\n\n".join(doc.page_content for doc in docs)
