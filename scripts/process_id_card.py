import sys
import os
from PIL import Image

def process_id_card(front_path, back_path, output_pdf_path):
    try:
        # Load images
        front = Image.open(front_path)
        back = Image.open(back_path)
        
        # A4 size at 300 DPI is approximately 2480 x 3508 pixels
        a4_width = 2480
        a4_height = 3508
        
        # Create a new white A4 image
        a4_image = Image.new('RGB', (a4_width, a4_height), 'white')
        
        # ID Card is roughly 85.6mm x 53.98mm
        # At 300 DPI, that's roughly 1011 x 638 pixels
        # However, the scanner might have scanned the whole A4 bed.
        # For this robust script, we will just crop the top-left 1200x1200 region of the scans,
        # where the user placed the ID card, and then scale it to fit nicely.
        
        # Crop top-left (assumes scanner origin is top-left)
        # Let's crop 1200x1200 from the scan
        box = (0, 0, min(1200, front.width), min(1200, front.height))
        front_cropped = front.crop(box)
        
        box_back = (0, 0, min(1200, back.width), min(1200, back.height))
        back_cropped = back.crop(box_back)
        
        # Calculate positions to center them on the top and bottom halves of the A4
        # Top half center
        x1 = (a4_width - front_cropped.width) // 2
        y1 = (a4_height // 4) - (front_cropped.height // 2)
        
        # Bottom half center
        x2 = (a4_width - back_cropped.width) // 2
        y2 = (a4_height * 3 // 4) - (back_cropped.height // 2)
        
        # Paste onto A4
        a4_image.paste(front_cropped, (x1, y1))
        a4_image.paste(back_cropped, (x2, y2))
        
        # Save as PDF
        a4_image.save(output_pdf_path, "PDF", resolution=300.0)
        print(f"Successfully created ID card PDF at {output_pdf_path}")
        return True
    except Exception as e:
        print(f"Error processing ID card: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python process_id_card.py <front_image> <back_image> <output_pdf>")
        sys.exit(1)
        
    front_img = sys.argv[1]
    back_img = sys.argv[2]
    out_pdf = sys.argv[3]
    
    if not os.path.exists(front_img):
        print(f"Front image not found: {front_img}", file=sys.stderr)
        sys.exit(1)
        
    if not os.path.exists(back_img):
        print(f"Back image not found: {back_img}", file=sys.stderr)
        sys.exit(1)
        
    process_id_card(front_img, back_img, out_pdf)
