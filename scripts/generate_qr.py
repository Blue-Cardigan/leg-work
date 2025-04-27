# legislation-editor/scripts/generate_qr.py
import qrcode
import os

# Define the URL
url = "https://leg-work.vercel.app/"

# Define the output directory and filename
output_dir = "qrcodes"
filename = "leg-work_qr.png"
output_path = os.path.join(output_dir, filename)

# Create the output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

# Generate QR code
img = qrcode.make(url)

# Save the image
img.save(output_path)

print(f"QR code generated and saved to {output_path}") 