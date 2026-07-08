import os
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)


def upload_pdf_to_cloud(file_path: str, public_id: str) -> dict:
    """Upload PDF to Cloudinary and return the direct secure URL."""
    result = cloudinary.uploader.upload(
        file_path,
        resource_type="raw",
        public_id=public_id,
        folder="askmynotes_pdfs",
        overwrite=True,
    )
    # Use the URL exactly as Cloudinary returns it — no custom transformation flags
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
        "bytes": result["bytes"],
        "created_at": result.get("created_at", ""),
    }


def delete_pdf_from_cloud(public_id: str) -> bool:
    try:
        cloudinary.uploader.destroy(public_id, resource_type="raw")
        return True
    except Exception:
        return False
