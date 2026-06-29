import os
import httpx

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

async def search_youtube_video(topic: str) -> dict:
    """Single video search — kept for backward compat."""
    results = await search_youtube_videos(topic, max_results=1)
    if results.get("videos"):
        return results["videos"][0]
    return {"error": "No video found"}


async def search_youtube_videos(topic: str, max_results: int = 5) -> dict:
    """Search YouTube for multiple educational videos on a topic."""
    if not YOUTUBE_API_KEY:
        return {"error": "YouTube API key not configured", "videos": []}

    query = f"{topic} explained lecture tutorial education"

    async with httpx.AsyncClient() as client:
        resp = await client.get(YOUTUBE_SEARCH_URL, params={
            "part": "snippet",
            "q": query,
            "type": "video",
            "videoDuration": "any",
            "maxResults": max_results,
            "relevanceLanguage": "en",
            "videoEmbeddable": "true",
            "safeSearch": "strict",
            "key": YOUTUBE_API_KEY,
        })

    data = resp.json()
    items = data.get("items", [])

    videos = []
    for item in items:
        video_id = item["id"]["videoId"]
        snippet = item["snippet"]
        videos.append({
            "video_id": video_id,
            "title": snippet["title"],
            "channel": snippet["channelTitle"],
            "thumbnail": snippet["thumbnails"]["medium"]["url"],
            "embed_url": f"https://www.youtube.com/embed/{video_id}?autoplay=0",
            "watch_url": f"https://www.youtube.com/watch?v={video_id}",
        })

    return {
        "topic": topic,
        "videos": videos,
        "search_url": f"https://www.youtube.com/results?search_query={topic.replace(' ', '+')}+explained+lecture",
    }
