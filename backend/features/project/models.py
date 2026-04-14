from pydantic import BaseModel

class SaveProjectRequest(BaseModel):
    name: str
    image_url: str
    cropped_image_url: str
    mosaic_preview_url: str
    set_selections: list[dict]
    config: dict
    crop_state: dict | None = None
    mosaic_data: dict
    mosaic_history: list[dict] = []
