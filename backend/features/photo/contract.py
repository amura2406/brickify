class GooglePhotosAPI:
    def create_session(self, access_token: str) -> dict:
        raise NotImplementedError
        
    def poll_session(self, session_id: str, access_token: str) -> dict:
        raise NotImplementedError
        
    def list_media_items(self, session_id: str, access_token: str) -> list[dict]:
        raise NotImplementedError
        
    def download_photo(self, base_url: str, access_token: str) -> bytes:
        raise NotImplementedError
