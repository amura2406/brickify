from pydantic import BaseModel

class ApproveUserRequest(BaseModel):
    uid: str
