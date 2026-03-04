use wasm_bindgen::prelude::*;


#[wasm_bindgen] // 1 - IMPORTANT LINE
pub fn grayscale(pixels: &mut [u8]) { // 2 - FUNCTION SIGNATURE
    let length = pixels.len();
    let mut i = 0;

    // 3 - GENERAL LOGIC
    while i < length {
        let r = pixels[i] as u32;
        let g = pixels[i + 1] as u32;
        let b = pixels[i + 2] as u32;

        let gray = ((r + g + b) / 3) as u8;

        pixels[i] = gray;
        pixels[i + 1] = gray;
        pixels[i + 2] = gray;

        i += 4;
    }
}

#[wasm_bindgen]
pub fn sharpen(pixels: &mut [u8], width: usize, height: usize) {
    let kernel: [i32; 9] = [
         0, -1,  0,
        -1,  5, -1,
         0, -1,  0
    ];

    let mut output = pixels.to_vec(); // 1 - READ-ONLY COPY

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let mut r = 0;
            let mut g = 0;
            let mut b = 0;

            for ky in 0..3 {
                for kx in 0..3 {
                    let px = (y + ky - 1) * width + (x + kx - 1);
                    let idx = px * 4;

                    let weight = kernel[ky * 3 + kx];

                    r += pixels[idx] as i32 * weight;
                    g += pixels[idx + 1] as i32 * weight;
                    b += pixels[idx + 2] as i32 * weight;
                }
            }

            let idx = (y * width + x) * 4;
            // 2 - COMPILES TO A SINGLE MATH INSTRUCTION
            output[idx] = r.clamp(0, 255) as u8;
            output[idx + 1] = g.clamp(0, 255) as u8;
            output[idx + 2] = b.clamp(0, 255) as u8;
        }
    }

    pixels.copy_from_slice(&output); // 3 - WRITES RESULT TO SHARED WASM MEMORY BUFFER
}
