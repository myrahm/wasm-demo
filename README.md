# WebAssembly Demo Guide
### CPS730 — Tech Demo Companion | Group 3

> **How to use this guide:** This README lives alongside the demo repo at [github.com/myrahm/wasm-demo](https://github.com/myrahm/wasm-demo). It covers everything from background concepts to a full walkthrough of the code, so you can revisit any part of the demo on your own after the session.

---

## Table of Contents

1. [What This Demo Does](#1-what-this-demo-does)
2. [Background Concepts](#2-background-concepts)
   - [What is WebAssembly?](#what-is-webassembly)
   - [How Does WASM Fit Into the Browser?](#how-does-wasm-fit-into-the-browser)
   - [Why Use It?](#why-use-it)
3. [Repo Structure](#3-repo-structure)
4. [Prerequisites & Setup Instructions](#4-prerequisites--setup-instructions)
   - [What You Need](#what-you-need)
   - [Cloning the Repo](#cloning-the-repo)
   - [Verifying Your Environment](#verifying-your-environment)
   - [Optional: Rebuilding the WASM Binary](#optional-rebuilding-the-wasm-binary)
5. [Running the Demo Yourself](#5-running-the-demo-yourself)
6. [Code Walkthrough](#6-code-walkthrough)
   - [Loading the WASM Module](#loading-the-wasm-module-mainjs)
   - [How Image Data Works](#how-image-data-works)
   - [Race 1: Grayscale](#race-1-grayscale)
   - [Race 2: Sharpen Filter](#race-2-sharpen-filter)
   - [Calling WASM from JavaScript](#calling-wasm-from-javascript)
   - [Timing the Races](#timing-the-races)
7. [The Rust Side](#7-the-rust-side)
   - [Exposing Functions with wasm-bindgen](#exposing-functions-with-wasm-bindgen)
   - [Rust Grayscale](#rust-grayscale)
   - [Rust Sharpen](#rust-sharpen)
8. [Troubleshooting](#8-troubleshooting)
9. [Clean-up](#9-clean-up)
10. [JavaScript vs WebAssembly: Side by Side](#10-javascript-vs-webassembly-side-by-side)
11. [Why Is WASM Faster?](#11-why-is-wasm-faster)
12. [Key Takeaways](#12-key-takeaways)
13. [Further Reading](#13-further-reading)

---

## 1. What This Demo Does

This demo lets you upload any image and run two image-processing filters on it: a **grayscale** filter and a **sharpen** filter. Each filter runs twice in parallel: once implemented in plain JavaScript, and once in **Rust compiled to WebAssembly**. Both produce the exact same visual output. The only difference is execution speed, which is measured and displayed in milliseconds.

The goal is to make one thing concrete: **WebAssembly is not just a concept: it's measurably faster for computation-heavy tasks, and it integrates invisibly into JavaScript.**

**Race 1: Grayscale** is a simple filter. Each pixel gets its R, G, and B channels averaged into a single grey value. It's light work, so the performance gap between JS and WASM is modest.

**Race 2: Sharpen** is a convolution filter. For every pixel, it looks at the 8 surrounding pixels and applies a weighted calculation across all 9 of them. On a large image this means tens of millions of operations, and that's exactly where WASM's advantage becomes obvious.

---

## 2. Background Concepts

### What is WebAssembly?

WebAssembly (WASM) is a **low-level binary instruction format** designed to be a compilation target, meaning you don't write it directly. Instead, you write code in a language like Rust, C, or C++, and a compiler converts it into a `.wasm` file containing compact binary bytecode.

A `.wasm` module is not tied to any specific CPU. It follows a **virtual instruction set architecture (ISA)** based on a stack machine model, which means instructions push and pop values on an implicit stack rather than referencing CPU registers directly. This makes WASM **machine-independent**: the same `.wasm` file runs on x86, ARM, or any other architecture, as long as there's a runtime engine available.

The runtime engine, built into every modern browser, is responsible for decoding the WASM bytecode, validating it (checking for type safety and memory safety), and translating it into native machine code for the host CPU.

```
Your Rust code  →  (wasm-pack)  →  .wasm binary  →  Browser engine  →  Native CPU instructions
```

### How Does WASM Fit Into the Browser?

WebAssembly runs **inside the same JavaScript engine** that runs JS, V8 in Chrome, SpiderMonkey in Firefox, JavaScriptCore in Safari. It does not replace JavaScript. Instead it complements it:

- **JavaScript** handles the DOM, events, UI logic, and orchestration.
- **WebAssembly** handles heavy computation.

WASM cannot access the DOM or browser APIs directly. It communicates with JavaScript through **imports and exports**: JS can call functions exported from a WASM module, and WASM can call functions imported from JS. They also share a **linear memory buffer**: a flat, contiguous array of bytes that both sides can read and write.

In this demo, JavaScript extracts raw pixel bytes from the canvas into a `Uint8ClampedArray`, passes it directly into the WASM function, and reads it back after the function returns. No extra copying, no serialization.

WASM also runs inside the **browser sandbox**, it cannot access your filesystem, cannot make arbitrary system calls, and is validated before execution. So it gets near-native speed without native-code security risks.

### Why Use It?

Three main reasons:

- **Performance.** JavaScript is dynamically typed and JIT-compiled at runtime. WASM is statically typed and compiled ahead of time (before the browser ever sees it). For loops doing heavy numerical work, like image processing, WASM executes significantly faster because the browser engine can skip the type-inference and JIT warm-up steps.

- **Language flexibility.** WASM lets you bring existing code written in Rust, C, C++, Go, Swift, Zig, and more into the browser without rewriting it in JavaScript.

- **Portability.** The same `.wasm` binary runs across operating systems, browsers, and CPU architectures. Beyond the browser, standalone runtimes like Wasmtime and Wasmer let WASM run on servers and edge infrastructure too.

---

## 3. Repo Structure

```
wasm-demo/
├── rust-wasm/
│   ├── src/
│   │   └── lib.rs          ← Rust source code (the two image filters)
│   └── Cargo.toml          ← Rust package config (dependencies, crate type)
│
└── web/
    ├── index.html          ← The UI (two canvases per race, buttons, timers)
    ├── main.js             ← JS entry point (image upload, JS filters, WASM calls)
    └── pkg/                ← Auto-generated by wasm-pack (do not edit manually)
        ├── image_processor.js      ← JS glue code (loads .wasm, exports functions)
        ├── image_processor_bg.wasm ← The compiled binary
        └── ...
```

**`lib.rs`** is the only Rust file you need to understand. It defines two public functions: `grayscale` and `sharpen`, and exposes them to JavaScript using the `wasm-bindgen` crate.

**`main.js`** imports those functions from `pkg/image_processor.js`, implements equivalent JavaScript versions of the same filters, and wires everything up to the HTML buttons.

**`pkg/`** is generated automatically by running `wasm-pack build` inside the `rust-wasm/` directory. You never edit these files, they are the compiled output and the JS bindings wasm-pack creates so that calling Rust functions from JS looks identical to calling regular JS functions.

---

## 4. Prerequisites & Setup Instructions

This section covers everything you need installed and configured before you can run or modify the demo. The demo ships with a pre-compiled `.wasm` binary in `web/pkg/`, so **you do not need Rust installed just to run it**, ou only need a browser and a way to serve static files. Rust and wasm-pack are only required if you want to modify `lib.rs` and recompile.

### What You Need

**To run the demo (required):**

| Requirement | Version | How to check |
|---|---|---|
| A modern browser | Chrome 89+, Firefox 89+, Safari 15+, Edge 89+ | Check your browser's About page |
| Python **or** Node.js | Python 3.x / Node 14+ | `python3 --version` / `node --version` |
| Git | Any recent version | `git --version` |

> All modern browsers shipped full WebAssembly support by 2021. If you're on an up-to-date browser, you're fine.

**To modify and rebuild the Rust source (optional):**

| Requirement | Version | Install |
|---|---|---|
| Rust toolchain | stable (1.70+) | `curl https://sh.rustup.rs -sSf \| sh` |
| wasm-pack | 0.12+ | `cargo install wasm-pack` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |

---

### Cloning the Repo

```bash
git clone https://github.com/myrahm/wasm-demo.git
cd wasm-demo
```

The `web/pkg/` directory is already committed to the repo and contains a working compiled binary. You can skip straight to running the demo without building anything.

**Expected output after cloning — confirm these files exist:**

```
web/pkg/
├── image_processor.js        ← JS glue code generated by wasm-bindgen
├── image_processor_bg.wasm   ← the compiled binary
└── ...
```

If `web/pkg/` is empty or missing, you will need to build the WASM binary yourself, see [Optional: Rebuilding the WASM Binary](#optional-rebuilding-the-wasm-binary) below.

---

### Verifying Your Environment

Before running the demo, confirm you have what you need:

```bash
# Confirm Python is available (Option A server)
python3 --version
# Expected: Python 3.x.x

# OR confirm Node is available (Option B server)
node --version
# Expected: v14.x.x or higher

# Confirm the compiled binary exists
ls web/pkg/
# Expected: image_processor.js  image_processor_bg.wasm  (among other files)
```

If `web/pkg/` exists and contains those two files, you're ready to run the demo with no further setup.

---

### Optional: Rebuilding the WASM Binary

Only follow these steps if you have modified `rust-wasm/src/lib.rs` and need to recompile, or if `web/pkg/` is missing entirely.

**Step 1: Install Rust** (skip if already installed):

```bash
curl https://sh.rustup.rs -sSf | sh
# Follow the on-screen prompts, then reload your shell:
source "$HOME/.cargo/env"

# Verify:
rustc --version
# Expected: rustc 1.xx.x (...)
```

**Step 2: Add the WebAssembly compilation target:**

```bash
rustup target add wasm32-unknown-unknown
# Expected: info: component 'rust-std' for target 'wasm32-unknown-unknown' installed
```

**Step 3: Install wasm-pack:**

```bash
cargo install wasm-pack

# Verify:
wasm-pack --version
# Expected: wasm-pack 0.12.x
```

**Step 4: Build:**

```bash
cd rust-wasm/
wasm-pack build --target web --out-dir ../web/pkg
```

**Expected output:**

```
[INFO]: Checking for the Wasm target...
[INFO]: Compiling to Wasm...
[INFO]: Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: :-) Done in Xs
[INFO]: :-) Your wasm pkg is ready to publish at .../web/pkg.
```

After this completes, `web/pkg/` will be populated with fresh files and the demo is ready to serve.

---

## 5. Running the Demo Yourself

The demo is a browser app that uses ES modules (`type="module"` in the script tag). Because of browser security restrictions around module loading, **you cannot open `index.html` by double-clicking it**, you need a local web server.

**Option A: Python (easiest, no install needed if you have Python)**

```bash
# From inside the web/ folder
cd web/
python3 -m http.server 8080
# Then open http://localhost:8080 in your browser
```

**Option B: Node.js**

```bash
npx serve web/
# Then open the URL it prints
```

**Option C: VS Code Live Server extension**

Right-click `index.html` in VS Code → "Open with Live Server".

Once it's running:

1. Click the file upload input and choose any image. Larger images (2000×1500 px or bigger) make the performance difference more dramatic.
2. Click **Run Grayscale Race**: both canvases render and timings appear below each one.
3. Click **Run Sharpen Race**: same thing. Watch how the JS vs WASM gap widens for this heavier task.

> **Tip:** If you want to rebuild the Rust code yourself after making changes to `lib.rs`, you need Rust and wasm-pack installed:
> ```bash
> curl https://sh.rustup.rs -sSf | sh          # install Rust
> cargo install wasm-pack                        # install wasm-pack
> cd rust-wasm/
> wasm-pack build --target web --out-dir ../web/pkg
> ```

---

## 6. Code Walkthrough

### Loading the WASM Module (`main.js`)

The very top of `main.js`:

```js
import init, { grayscale, sharpen } from "./pkg/image_processor.js";

await init();
```

`image_processor.js` is the wasm-bindgen-generated glue file. It exports:
- `init`: an async function that fetches and compiles the `.wasm` binary
- `grayscale`: the Rust grayscale function, wrapped so JS can call it
- `sharpen`: the Rust sharpen function, wrapped the same way

`await init()` must complete before any WASM functions can be called. It fetches the `.wasm` file over the network (or from cache), compiles it into native code, and sets up the linear memory. After that one line, `grayscale` and `sharpen` work like any other JavaScript function.

---

### How Image Data Works

Both the JS and WASM versions operate on the same underlying data structure: a flat array of bytes where every 4 consecutive bytes represent one pixel.

```
Index:   0    1    2    3    4    5    6    7    8  ...
Value:  [R0] [G0] [B0] [A0] [R1] [G1] [B1] [A1] [R2] ...
         ↑ pixel 0 ↑           ↑ pixel 1 ↑
```

- **R** = red channel (0–255)
- **G** = green channel (0–255)
- **B** = blue channel (0–255)
- **A** = alpha / opacity (0–255) — neither filter touches this

In JavaScript, this array is accessed as a `Uint8ClampedArray`, retrieved from the canvas:

```js
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const pixels = imageData.data; // Uint8ClampedArray
```

In Rust, the same array arrives as a `&mut [u8]` — a mutable slice of bytes. The layout is identical. Every 4 bytes is one pixel, so both versions increment by 4 each step.

---

### Race 1: Grayscale

**The algorithm:** For each pixel, compute the average of R, G, and B, then set all three channels to that average. The result is a grey pixel whose brightness matches the original colour's perceived luminance.

**JavaScript implementation:**

```js
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
        pixels[i]     = gray;   // R
        pixels[i + 1] = gray;   // G
        pixels[i + 2] = gray;   // B
        // pixels[i + 3] is alpha — untouched
    }

    const end = performance.now();

    ctx.putImageData(imageData, 0, 0);
    return end - start;
}
```

The loop steps through every 4th byte (one full pixel per iteration). The alpha channel at `i + 3` is never read or written.

---

### Race 2: Sharpen Filter

**The algorithm:** A sharpen filter is a **convolution** — a mathematical operation where each output pixel is computed from a weighted sum of itself and its neighbours. The weights are defined in a **kernel** (a small matrix).

The sharpen kernel used here is:

```
 0  -1   0
-1   5  -1
 0  -1   0
```

For each pixel, we multiply each of its 9 neighbours by the corresponding kernel value and sum the results. The center pixel gets multiplied by 5 (boosted), while its four cardinal neighbours each get multiplied by -1 (subtracted). This enhances edges and fine detail.

**Why we need a copy of the array:**

```js
const copy = new Uint8ClampedArray(pixels);
```

We must read from the *original* pixel values and write to *pixels* separately. If we read and write the same array simultaneously, pixels we've already modified would corrupt the calculation for subsequent pixels, since each pixel's output depends on its neighbours' *original* values.

**JavaScript implementation:**

```js
function jsSharpen(img, canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const kernel = [
         0, -1,  0,
        -1,  5, -1,
         0, -1,  0
    ];

    const start = performance.now();

    const copy = new Uint8ClampedArray(pixels); // read-only source
    const w = canvas.width;
    const h = canvas.height;

    // Skip the 1-pixel border (no complete 3×3 neighbourhood there)
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let r = 0, g = 0, b = 0;

            // Apply the 3×3 kernel
            for (let ky = 0; ky < 3; ky++) {
                for (let kx = 0; kx < 3; kx++) {
                    const px  = (y + ky - 1) * w + (x + kx - 1);
                    const idx = px * 4;
                    const weight = kernel[ky * 3 + kx];

                    r += copy[idx]     * weight;
                    g += copy[idx + 1] * weight;
                    b += copy[idx + 2] * weight;
                }
            }

            const idx = (y * w + x) * 4;
            pixels[idx]     = Math.min(255, Math.max(0, r)); // clamp to 0–255
            pixels[idx + 1] = Math.min(255, Math.max(0, g));
            pixels[idx + 2] = Math.min(255, Math.max(0, b));
        }
    }

    const end = performance.now();

    ctx.putImageData(imageData, 0, 0);
    return end - start;
}
```

For a 2000×1500 image (~3 million pixels), this loop runs approximately **27 million multiply-add operations** inside JavaScript.

---

### Calling WASM from JavaScript

```js
function wasmGrayscale(img, canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const start = performance.now();
    grayscale(imageData.data);          // ← Rust function, called like a JS function
    const end = performance.now();

    ctx.putImageData(imageData, 0, 0);
    return end - start;
}

function wasmSharpen(img, canvas) {
    // ...same canvas setup...
    const start = performance.now();
    sharpen(imageData.data, canvas.width, canvas.height); // ← Rust function
    const end = performance.now();
    // ...
}
```

This is one of the key design points of WebAssembly: **from JavaScript's perspective, a WASM function is indistinguishable from a JS function.** There's no special syntax for crossing the boundary. The wasm-bindgen-generated glue code handles passing the data into WASM's linear memory and back.

`imageData.data` is a `Uint8ClampedArray` in JavaScript, but wasm-bindgen converts it into a `&mut [u8]` slice in Rust, pointing at the same underlying memory. The Rust function mutates the bytes in place, and when it returns, `imageData.data` in JavaScript already contains the updated pixels. No return value, no copying.

---

### Timing the Races

The buttons in the UI call both versions and display the timings:

```js
document.getElementById("runGrayRace").onclick = () => {
    if (!uploadedImage) return alert("Upload an image first!");

    const jsTime   = jsGrayscale(uploadedImage, document.getElementById("jsGrayCanvas"));
    const wasmTime = wasmGrayscale(uploadedImage, document.getElementById("wasmGrayCanvas"));

    document.getElementById("jsGrayTime").innerText   = `JS: ${jsTime.toFixed(2)} ms`;
    document.getElementById("wasmGrayTime").innerText = `WASM: ${wasmTime.toFixed(2)} ms`;
};
```

The timing is done with `performance.now()`, which gives sub-millisecond precision. Critically, the timer only runs around the computation loop, not around the canvas reads, canvas writes, or any other setup. This isolates the difference to pure processing time.

---

## 7. The Rust Side

### Exposing Functions with `wasm-bindgen`

```rust
use wasm_bindgen::prelude::*;
```

`wasm_bindgen` is a Rust crate (library) that acts as the bridge between Rust and JavaScript. It generates the JS glue code in `pkg/` when you run `wasm-pack build`. Without it, you could still compile Rust to WASM, but calling the functions from JS would be much more manual.

The `#[wasm_bindgen]` attribute above a function tells the compiler: *expose this function to JavaScript*. Any function without it remains internal to the WASM module and cannot be called from JS.

---

### Rust Grayscale

```rust
#[wasm_bindgen]
pub fn grayscale(pixels: &mut [u8]) {
    let length = pixels.len();
    let mut i = 0;

    while i < length {
        let r = pixels[i]     as u32;
        let g = pixels[i + 1] as u32;
        let b = pixels[i + 2] as u32;

        let gray = ((r + g + b) / 3) as u8;

        pixels[i]     = gray;
        pixels[i + 1] = gray;
        pixels[i + 2] = gray;

        i += 4;
    }
}
```

**`&mut [u8]`**, a mutable slice of unsigned 8-bit integers. `u8` means each byte is exactly 0–255. The Rust compiler knows this at compile time and generates optimized machine code for the arithmetic accordingly. There's no runtime type checking happening inside this loop.

The values are cast to `u32` before adding (`as u32`) to avoid arithmetic overflow, three `u8` values can sum to at most 765, which fits in a `u32` but not a `u8`. The result is cast back to `u8` after dividing.

The function has no return value, it mutates `pixels` in place. Since `pixels` is a reference into WASM's linear memory (the same memory JavaScript's `imageData.data` is reading), JavaScript sees the changes immediately after the call returns.

---

### Rust Sharpen

```rust
#[wasm_bindgen]
pub fn sharpen(pixels: &mut [u8], width: usize, height: usize) {
    let kernel: [i32; 9] = [
         0, -1,  0,
        -1,  5, -1,
         0, -1,  0
    ];

    let mut output = pixels.to_vec(); // read-only copy

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let mut r = 0i32;
            let mut g = 0i32;
            let mut b = 0i32;

            for ky in 0..3 {
                for kx in 0..3 {
                    let px  = (y + ky - 1) * width + (x + kx - 1);
                    let idx = px * 4;
                    let weight = kernel[ky * 3 + kx];

                    r += pixels[idx]     as i32 * weight;
                    g += pixels[idx + 1] as i32 * weight;
                    b += pixels[idx + 2] as i32 * weight;
                }
            }

            let idx = (y * width + x) * 4;
            output[idx]     = r.clamp(0, 255) as u8;
            output[idx + 1] = g.clamp(0, 255) as u8;
            output[idx + 2] = b.clamp(0, 255) as u8;
        }
    }

    pixels.copy_from_slice(&output); // write results back
}
```

`pixels.to_vec()` creates a copy of the input for reading, same reason as the JavaScript version. The kernel uses `i32` (signed 32-bit integers) because kernel values can be negative (-1).

`.clamp(0, 255)` is Rust's built-in range clamp. It's equivalent to JavaScript's `Math.min(255, Math.max(0, value))` but compiles to a single CPU instruction.

At the end, `pixels.copy_from_slice(&output)` writes the computed results back to the original buffer, which is WASM's linear memory, visible directly from JavaScript.

---

## 8. Troubleshooting

### The page is blank or the browser console shows a CORS / module loading error

**Symptom:** You opened `index.html` directly (via `file://`) and see an error like:
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource
```
or
```
Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of ""
```

**Cause:** Browsers block ES module imports and `.wasm` file fetches from `file://` URLs as a security restriction.

**Fix:** You must serve the files through a local HTTP server. See [Running the Demo Yourself](#5-running-the-demo-yourself) — any of the three server options (Python, Node, VS Code Live Server) will resolve this immediately.

---

### `wasm-pack build` fails with "error[E0463]: can't find crate for `std`"

**Symptom:**
```
error[E0463]: can't find crate for `std`
  = note: the `wasm32-unknown-unknown` target may not be installed
```

**Cause:** The WebAssembly compilation target hasn't been added to your Rust toolchain.

**Fix:**
```bash
rustup target add wasm32-unknown-unknown
```
Then re-run `wasm-pack build --target web --out-dir ../web/pkg`.

---

### `wasm-pack` command not found after `cargo install wasm-pack`

**Symptom:** You ran `cargo install wasm-pack` but the terminal says `command not found: wasm-pack`.

**Cause:** Cargo's `bin` directory is not on your `PATH`.

**Fix:**
```bash
source "$HOME/.cargo/env"
```
Or add this line to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) and restart your terminal. Then verify with `wasm-pack --version`.

---

### The demo loads but both canvases stay blank after clicking a race button

**Symptom:** You click "Run Grayscale Race" or "Run Sharpen Race" and nothing appears on the canvases.

**Cause:** Most likely no image has been uploaded yet, or the WASM module failed to initialize silently.

**Fix — Step 1:** Make sure you selected an image file using the upload input *before* clicking a race button. The alert "Upload an image first!" should appear if not — if it doesn't, check the browser console for JS errors.

**Fix — Step 2:** Open the browser's Developer Tools (F12) → Console tab. Look for any red errors on page load. A common one is:

```
TypeError: Failed to fetch dynamically imported module: .../pkg/image_processor.js
```

This means the `pkg/` directory is missing or incomplete. Confirm `web/pkg/image_processor_bg.wasm` exists. If not, rebuild — see [Optional: Rebuilding the WASM Binary](#optional-rebuilding-the-wasm-binary).

---

### `wasm-pack build` succeeds but the demo still uses old behaviour

**Symptom:** You edited `lib.rs`, rebuilt, but the browser still runs the old code.

**Cause:** The browser has cached the old `.wasm` file.

**Fix:** Hard-refresh the page with `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac). Alternatively, open DevTools → Network tab → check "Disable cache", then refresh normally.

---

### Performance numbers are unexpectedly similar for JS and WASM

**Symptom:** Both implementations finish in roughly the same time, even for the sharpen filter.

**Cause:** The image uploaded is too small (under ~500×500 px). On small images, both implementations finish so quickly that the difference is within measurement noise.

**Fix:** Upload a larger image — ideally 2000×1500 px or bigger. The sharpen filter's advantage is proportional to pixel count: at 3MP the difference becomes clearly visible, often 3–10× depending on browser and hardware.

---

### `rustup` or `curl` commands fail on Windows

**Cause:** The `curl | sh` install pattern is for macOS/Linux. Windows uses a different installer.

**Fix:** Download and run `rustup-init.exe` directly from [rustup.rs](https://rustup.rs). After installation, use the **Rust** section of the Start menu or open a new terminal. All `cargo` and `rustup` commands work the same after that.

---

## 9. Clean-up

This section describes how to fully remove everything installed or generated during this demo, in case you want to return your environment to its original state.

### Remove the cloned repository

This deletes all project files including the compiled `pkg/` directory:

```bash
cd ..                  # move out of the wasm-demo folder first
rm -rf wasm-demo/      # macOS / Linux
# Windows (PowerShell): Remove-Item -Recurse -Force wasm-demo
```

---

### Remove wasm-pack

wasm-pack is installed as a Cargo binary. To remove it:

```bash
cargo uninstall wasm-pack

# Verify it's gone:
wasm-pack --version
# Expected: command not found
```

---

### Remove the wasm32 compilation target

If you added the WebAssembly target to your Rust toolchain and no longer want it:

```bash
rustup target remove wasm32-unknown-unknown

# Verify:
rustup target list --installed
# wasm32-unknown-unknown should no longer appear
```

---

### Remove Rust entirely

If you installed Rust specifically for this demo and want to remove it completely:

```bash
rustup self uninstall
```

This removes `rustup`, `rustc`, `cargo`, all installed toolchains, and all Cargo-installed binaries (including wasm-pack if still present). It does **not** remove any project files — you would still need to delete the `wasm-demo/` folder separately.

---

### Stop the local development server

If you started a Python or Node server and want to shut it down:

```bash
# In the terminal where the server is running:
Ctrl+C
```

The server process exits and port 8080 (or whichever port was used) is freed. No files are modified by stopping the server.

---

### What does NOT need clean-up

- **The browser** — no extensions, settings, or persistent data were installed. Closing the tab is sufficient.
- **`web/pkg/`** — these are just files in the repo folder. Deleting the repo folder removes them. They do not install anything system-wide.
- **Python's `http.server`** — built into Python, nothing was installed.
- **`npx serve`** — npx downloads packages temporarily; they are stored in npm's cache (`~/.npm/_npx`). If you want to clear this: `npm cache clean --force`.

---

## 10. JavaScript vs WebAssembly: Side by Side

| | JavaScript | Rust / WebAssembly |
|---|---|---|
| **Type system** | Dynamic — types inferred at runtime | Static — `u8`, `i32`, `usize` known at compile time |
| **Compilation** | JIT-compiled in the browser at runtime | AOT-compiled to WASM before the browser sees it |
| **Memory model** | Managed heap, garbage-collected | Linear memory — contiguous, manually managed |
| **Array type** | `Uint8ClampedArray` | `&mut [u8]` (mutable byte slice) |
| **Clamping** | `Math.min(255, Math.max(0, v))` | `v.clamp(0, 255)` — single instruction |
| **Buffer copy** | `new Uint8ClampedArray(pixels)` | `pixels.to_vec()` |
| **Write back** | Writes to `pixels` directly (shared) | `pixels.copy_from_slice(&output)` |
| **Call from JS** | Normal function call | Normal function call (same syntax) |
| **DOM access** | Direct | Not possible — must go through JS |
| **Startup cost** | None | One-time `await init()` to load and compile |

---

## 11. Why Is WASM Faster?

**1. Compiled ahead of time.**
The Rust code is compiled into optimized WASM bytecode *before* it ever reaches the browser. JavaScript is JIT-compiled at runtime. the engine has to discover types, compile hot code paths, and potentially re-optimize as it runs. WASM skips all of that.

**2. Static types let the compiler optimize better.**
When the Rust compiler knows `pixels[i]` is always a `u8`, it can emit tight, specific machine instructions for every operation. JavaScript engines try to do the same with JIT optimization, but they can be "deoptimized" if their type assumptions turn out to be wrong, which adds overhead — especially in tight numerical loops.

**3. Predictable linear memory.**
WASM operates on a flat array of bytes in its linear memory. CPUs are very good at prefetching and caching sequential memory access. JavaScript's garbage-collected heap can have fragmentation and unpredictable access patterns that interrupt this.

**4. No interpreter overhead in the inner loop.**
After `init()`, calling a WASM function drops directly into compiled native code. Every iteration of the pixel loop runs as machine instructions, not as interpreted bytecode.

**5. Why grayscale is close but sharpen is very different.**
Grayscale does 1 computation per pixel, even JavaScript JIT handles this reasonably well. Sharpen does 9 multiply-add operations per pixel across a nested loop structure. The overhead of JavaScript's dynamic execution multiplies across every one of those operations, and the gap grows proportionally with workload complexity.

---

## 12. Key Takeaways

- **WebAssembly is a compilation target, not a language you write directly.** You write Rust (or C, C++, Go, etc.) and compile it to `.wasm`.

- **WASM follows a stack-based virtual ISA.** It is machine-independent — the same `.wasm` runs on any CPU, and the browser engine compiles it to native instructions on the fly.

- **WASM does not replace JavaScript.** They are complementary. JS handles the DOM, events, and orchestration. WASM handles heavy computation.

- **The integration is seamless.** From JavaScript's perspective, calling a WASM function looks identical to calling a regular JS function. `wasm-bindgen` handles the bridge.

- **Shared linear memory is the key to efficiency.** WASM and JS pass data through a shared buffer, no serialization, no copying, no overhead at the boundary for raw byte arrays.

- **The performance advantage scales with workload.** Simple operations like grayscale show a modest gap. Complex operations like convolution (sharpen) show a dramatic one, because WASM's advantages compound over more operations per pixel.

- **WASM is secure.** It runs inside the browser sandbox, cannot access the filesystem or system calls, and is validated for type safety before execution.

---

## 13. Further Reading

| Resource | What it covers |
|---|---|
| [WebAssembly.org](https://webassembly.org) | Official site — spec, use cases, supported languages |
| [MDN: WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly) | Browser API reference, tutorials |
| [WebAssembly Core Spec (W3C)](https://www.w3.org/TR/wasm-core-2/) | The formal specification |
| [wasm-bindgen docs](https://rustwasm.github.io/wasm-bindgen/) | How Rust-to-JS bindings work |
| [Rust and WebAssembly Book](https://rustwasm.github.io/docs/book/) | End-to-end guide for building WASM with Rust |
| [Lin Clark's Cartoon Intro to WASM](https://www.smashingmagazine.com/2017/05/abridged-cartoon-introduction-webassembly/) | Excellent conceptual overview, no prior knowledge needed |
| [Jakob Meier's WASM Road](https://www.jakobmeier.ch/wasm-road-0) | Deep dive into WASM's stack machine and virtual ISA |

---

*CPS730 Tech Demo — Group 3 | Myrah Mohammed · Jay Patel · Kavya Sagar Chudasama · Disha Pradipkumar Patel · Elli Min · Muhadisa Raza · Genevive Sanchez*
