from io import BytesIO
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors as rl_colors

def hex_to_rgb(hex_code: str) -> tuple[float, float, float]:
    """Convert hex #RRGGBB to (R, G, B) normalized (0.0-1.0)"""
    hex_code = hex_code.lstrip('#')
    return tuple(int(hex_code[i:i+2], 16) / 255.0 for i in (0, 2, 4))

def generate_instructions_pdf(grid: List[List[int]], colors: List[Dict[str, Any]], width: int, height: int) -> bytes:
    """Generate a multi-page PDF guide for a lego mosaic broken down by 16x16 plates."""
    
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # 1. Title Page and Legend
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, 750, "Mosaic Build Guide")
    c.setFont("Helvetica", 12)
    c.drawString(50, 730, f"Size: {width} x {height} studs")
    
    # Draw Legend
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 690, "Parts Legend")
    
    # Count occurrences
    counts = {i: 0 for i in range(len(colors))}
    for row in grid:
        for val in row:
            if val in counts:
                counts[val] += 1
            else:
                counts[val] = 1
                
    c.setFont("Helvetica", 10)
    y = 660
    per_col = 30
    x_offset = 50
    
    for i, color in enumerate(colors):
        if counts.get(i, 0) == 0:
            continue
            
        r, g, b = hex_to_rgb(color['hex'])
        c.setFillColorRGB(r, g, b)
        c.rect(x_offset, y, 15, 15, fill=1)
        
        c.setFillColorRGB(0, 0, 0)
        # Symbol could be a letter or number, we'll just use the index for simplicity
        c.drawString(x_offset + 25, y + 4, f"[{i}] {color['name']}: {counts[i]} studs")
        
        y -= 20
        if y < 50:
            y = 660
            x_offset += 200
            
    c.showPage()
    
    # 2. Break down into 16x16 plates
    plate_size = 16
    plates_x = (width + plate_size - 1) // plate_size
    plates_y = (height + plate_size - 1) // plate_size
    
    for py in range(plates_y):
        for px in range(plates_x):
            c.setFont("Helvetica-Bold", 16)
            c.drawString(50, 750, f"Section: Row {py+1}, Column {px+1}")
            
            # Start coordinates of the plate in the overall grid
            start_x = px * plate_size
            start_y = py * plate_size
            
            # End coordinates
            end_x = min(start_x + plate_size, width)
            end_y = min(start_y + plate_size, height)
            
            box_size = 25
            grid_x_start = 50
            grid_y_start = 700
            
            # Draw the grid
            for local_y, abs_y in enumerate(range(start_y, end_y)):
                for local_x, abs_x in enumerate(range(start_x, end_x)):
                    val = grid[abs_y][abs_x]
                    color = colors[val]
                    r, g, b = hex_to_rgb(color['hex'])
                    
                    # Draw filled rectangle
                    c.setFillColorRGB(r, g, b)
                    rect_x = grid_x_start + local_x * box_size
                    rect_y = grid_y_start - (local_y * box_size)
                    c.rect(rect_x, rect_y, box_size, box_size, fill=1)
                    
                    # Determine text color based on background luminance
                    luminance = 0.299*r + 0.587*g + 0.114*b
                    text_color = 0 if luminance > 0.5 else 1
                    c.setFillColorRGB(text_color, text_color, text_color)
                    
                    c.setFont("Helvetica", 8)
                    c.drawCentredString(rect_x + box_size/2, rect_y + box_size/2 - 3, str(val))
                    
            c.showPage()
            
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes
