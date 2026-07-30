"""Unit tests for rag_pipeline utility functions — no LLM or embeddings needed."""


def test_collection_name_format():
    from rag_pipeline import _collection_name

    name = _collection_name("user@example.com")
    assert name.startswith("user_")
    assert len(name) == 21   # "user_" (5) + md5 hex[:16] (16)
    assert name.isalnum() or "_" in name


def test_collection_name_is_deterministic():
    from rag_pipeline import _collection_name

    assert _collection_name("a@b.com") == _collection_name("a@b.com")


def test_collection_name_differs_per_user():
    from rag_pipeline import _collection_name

    assert _collection_name("alice@x.com") != _collection_name("bob@x.com")


def test_hash_is_case_insensitive():
    from rag_pipeline import _hash

    assert _hash("Hello World") == _hash("hello world")


def test_hash_strips_whitespace():
    from rag_pipeline import _hash

    assert _hash("hello") == _hash("  hello  ")


def test_hash_is_deterministic():
    from rag_pipeline import _hash

    assert _hash("test question") == _hash("test question")
