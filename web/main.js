import init, { grayscale, sharpen } from "./pkg/image_processor.js";

await init();

const upload = document.getElementById("upload");
let uploadedImage = null;

// Load image once
upload.onchange = (event) => {
    const file = event.target.files[0];
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
        uploadedImage = img;
    };
};

// ----------------------------
// JS Grayscale
// ----------------------------
function jsGrayscale(img, canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const start = performance.now();
    for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        pixels[i] = gray;
        pixels[i + 1] = gray;
        pixels[i + 2] = gray;
    }
    const end = performance.now();

    ctx.putImageData(imageData, 0, 0);
    return end - start;
}

// ----------------------------
// JS Sharpen
// ----------------------------
function jsSharpen(img, canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Sharpen kernel
    const kernel = [
         0, -1,  0,
        -1,  5, -1,
         0, -1,  0
    ];

    const start = performance.now();

    const copy = new Uint8ClampedArray(pixels);

    const w = canvas.width;
    const h = canvas.height;

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let r = 0, g = 0, b = 0;

            for (let ky = 0; ky < 3; ky++) {
                for (let kx = 0; kx < 3; kx++) {
                    const px = (y + ky - 1) * w + (x + kx - 1);
                    const idx = px * 4;
                    const weight = kernel[ky * 3 + kx];

                    r += copy[idx] * weight;
                    g += copy[idx + 1] * weight;
                    b += copy[idx + 2] * weight;
                }
            }

            const idx = (y * w + x) * 4;
            pixels[idx] = Math.min(255, Math.max(0, r));
            pixels[idx + 1] = Math.min(255, Math.max(0, g));
            pixels[idx + 2] = Math.min(255, Math.max(0, b));
        }
    }

    const end = performance.now();

    ctx.putImageData(imageData, 0, 0);
    return end - start;
}

// ----------------------------
// WASM Grayscale
// ----------------------------
function wasmGrayscale(img, canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const start = performance.now();
    grayscale(imageData.data);
    const end = performance.now();

    ctx.putImageData(imageData, 0, 0);
    return end - start;
}

// ----------------------------
// WASM Sharpen
// ----------------------------
function wasmSharpen(img, canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const start = performance.now();
    sharpen(imageData.data, canvas.width, canvas.height);
    const end = performance.now();

    ctx.putImageData(imageData, 0, 0);
    return end - start;
}

// ----------------------------
// Race Buttons
// ----------------------------

document.getElementById("runGrayRace").onclick = () => {
    if (!uploadedImage) return alert("Upload an image first!");

    const jsTime = jsGrayscale(uploadedImage, document.getElementById("jsGrayCanvas"));
    const wasmTime = wasmGrayscale(uploadedImage, document.getElementById("wasmGrayCanvas"));

    document.getElementById("jsGrayTime").innerText = `JS: ${jsTime.toFixed(2)} ms`;
    document.getElementById("wasmGrayTime").innerText = `WASM: ${wasmTime.toFixed(2)} ms`;
};

document.getElementById("runSharpenRace").onclick = () => {
    if (!uploadedImage) return alert("Upload an image first!");

    const jsTime = jsSharpen(uploadedImage, document.getElementById("jsSharpCanvas"));
    const wasmTime = wasmSharpen(uploadedImage, document.getElementById("wasmSharpCanvas"));

    document.getElementById("jsSharpTime").innerText = `JS: ${jsTime.toFixed(2)} ms`;
    document.getElementById("wasmSharpTime").innerText = `WASM: ${wasmTime.toFixed(2)} ms`;
};
