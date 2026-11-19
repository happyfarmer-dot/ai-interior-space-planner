import base64
import io
import os
from PIL import Image
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from pyngrok import ngrok, conf

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipe = None

def get_pipe():
    global pipe
    if pipe is None:
        import torch
        from diffusers import AutoPipelineForImage2Image
        print("Loading SDXL Turbo model with memory optimization...")
        torch.cuda.empty_cache()
        pipe = AutoPipelineForImage2Image.from_pretrained(
            "stabilityai/sdxl-turbo",
            torch_dtype=torch.float16,
            variant="fp16"
        )
        # Enable model CPU offload so it uses only ~3.5GB of GPU VRAM instead of 14GB!
        try:
            pipe.enable_model_cpu_offload()
        except Exception:
            pipe.to("cuda")
        print("Model Loaded Successfully!")
    return pipe

class RenderRequest(BaseModel):
    image: str
    prompt: str
    negative_prompt: str = "distorted walls, deformed furniture, blurry, lowres"
    width: int = 1024
    height: int = 768

@app.get("/health")
def health():
    return {"status": "ok", "model": "sdxl-turbo-colab"}

@app.post("/api/generate")
def generate(req: RenderRequest):
    p = get_pipe()
    img_b64 = req.image.split(",", 1)[1] if "," in req.image else req.image
    init_image = Image.open(io.BytesIO(base64.b64decode(img_b64))).convert("RGB")
    
    w = max(512, min(1024, (req.width // 8) * 8))
    h = max(512, min(1024, (req.height // 8) * 8))
    init_image = init_image.resize((w, h), Image.Resampling.LANCZOS)

    result = p(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        image=init_image,
        num_inference_steps=4,
        strength=0.65,
        guidance_scale=0.0,
    ).images[0]

    buf = io.BytesIO()
    result.save(buf, format="JPEG", quality=90)
    out_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return {
        "image": f"data:image/jpeg;base64,{out_b64}",
        "model": "colab-sdxl-turbo",
        "note": "Colab T4 GPU Render Complete"
    }

async def run_server(token: str = None):
    # If token provided and not already set
    if token:
        try:
            ngrok.set_auth_token(token)
        except Exception:
            pass

    # Ensure model starts loading
    get_pipe()

    # Disconnect any stale tunnels
    try:
        tunnels = ngrok.get_tunnels()
        for t in tunnels:
            ngrok.disconnect(t.public_url)
    except Exception:
        pass

    public_url = ngrok.connect(8000).public_url
    print("\n" + "=" * 55)
    print("🚀 Colab 生圖後端已成功啟動！")
    print("👉 請複製此網址貼入 App：", public_url)
    print("=" * 55 + "\n")

    config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()
