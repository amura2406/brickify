import urllib.request
import base64

resp = urllib.request.urlopen("data:text/plain;base64," + base64.b64encode(b"hello").decode())
print(resp.read())
