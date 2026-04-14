from pydantic import BaseModel

class GooglePhotosUploadRequest(BaseModel):
    access_token: str
    base_url: str

class CreateSessionRequest(BaseModel):
    access_token: str
