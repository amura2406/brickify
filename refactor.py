import sys

with open('frontend/app.js', 'r') as f:
    text = f.read()

# Replace state variables
text = text.replace('imageId: null', 'imageUrl: null')
text = text.replace('croppedImageId: null', 'croppedImageUrl: null')
text = text.replace('.imageId =', '.imageUrl =')
text = text.replace('.croppedImageId =', '.croppedImageUrl =')
text = text.replace('.imageId', '.imageUrl')
text = text.replace('.croppedImageId', '.croppedImageUrl')

# Replace API expectations
text = text.replace('data.image_id', 'data.url')
text = text.replace('image_id: state.imageUrl', 'url: state.imageUrl')
text = text.replace('image_id: state.croppedImageUrl', 'url: state.croppedImageUrl')

# Replace image source bindings
text = text.replace('`${API}/api/image/${state.imageUrl}`', 'state.imageUrl')
text = text.replace('`${API}/api/image/${state.croppedImageUrl}`', 'state.croppedImageUrl')

# Replace mosaic
text = text.replace('mosaicId: null', 'mosaicUrl: null')
text = text.replace('state.mosaicId', 'state.mosaicUrl')
text = text.replace('data.mosaic_id', 'data.preview_url')

with open('frontend/app.js', 'w') as f:
    f.write(text)
