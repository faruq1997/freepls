from PIL import Image
import io, os, shutil

# Screenshot path
src = r"C:\Users\SSD\.gemini\antigravity\brain\c47edad6-3420-4dc7-ac15-760c643399c9\.system_generated\steps\453\media_0.png"
out_dir = r"C:\Users\SSD\Desktop\smartPLS\assets"

img = Image.open(src).convert("RGBA")
w, h = img.size
print(f"Original size: {w}x{h}")

# Find bounding box of non-white content (icon is on left ~512px, full height)
# Crop to square 512x512 (the icon portion at 50% scale = 1024px original)
icon_px = min(w, h)
# The icon occupies roughly top-left 512x512 at the 0.5 scale
# Let's find exact bounds by looking for non-white pixels on right/bottom
bbox = img.getbbox()
print(f"Content bbox: {bbox}")

# Crop to content, then resize to 1024x1024
cropped = img.crop(bbox)
icon_1024 = cropped.resize((1024, 1024), Image.LANCZOS)
icon_1024.save(os.path.join(out_dir, "icon.png"), "PNG")
print("Saved icon.png (1024x1024)")

# Generate .ico with multiple sizes for Windows taskbar
sizes = [16, 24, 32, 48, 64, 128, 256]
ico_frames = [icon_1024.resize((s, s), Image.LANCZOS) for s in sizes]
ico_frames[0].save(
    os.path.join(out_dir, "icon.ico"),
    format="ICO",
    sizes=[(s, s) for s in sizes],
    append_images=ico_frames[1:]
)
print("Saved icon.ico with sizes:", sizes)

# Also copy to docs/
shutil.copy(os.path.join(out_dir, "icon.png"), r"C:\Users\SSD\Desktop\smartPLS\docs\icon.png")
print("Copied to docs/icon.png")

