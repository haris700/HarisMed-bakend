/**
 * Compresses images (max 1600px, 0.8 JPEG quality) to prevent 'Payload Too Large' (HTTP 413) errors.
 * Returns a promise resolving to { fileData: string (base64/dataUrl), mimeType: string }.
 */
export async function processFileForUpload(file) {
  if (!file) throw new Error("No file provided");

  const isImage = file.type ? file.type.startsWith('image/') : /\.(jpg|jpeg|png|webp|heic)$/i.test(file.name);

  if (isImage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve({ fileData: compressedDataUrl, mimeType: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error("Failed to process image file"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  // Handle PDF or other files
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({ 
        fileData: e.target.result, 
        mimeType: file.type || 'application/pdf' 
      });
    };
    reader.onerror = () => reject(new Error("Failed to read document"));
    reader.readAsDataURL(file);
  });
}
