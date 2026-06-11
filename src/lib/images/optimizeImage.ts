export type OptimizedImageMimeType = "image/webp" | "image/jpeg"

export interface OptimizeImageOptions {
  maxWidth: number
  maxHeight: number
  quality: number
}

export interface OptimizedImageResult {
  blob: Blob
  mimeType: OptimizedImageMimeType
  width: number
  height: number
}

export const isSupportedProductImageFile = (file: File) => {
  const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])
  return allowedMimeTypes.has(file.type.toLowerCase())
}

const canEncodeWebP = (() => {
  let cachedResult: boolean | null = null

  return async () => {
    if (cachedResult !== null) {
      return cachedResult
    }

    if (typeof document === "undefined") {
      cachedResult = false
      return cachedResult
    }

    try {
      const canvas = document.createElement("canvas")
      canvas.width = 1
      canvas.height = 1
      cachedResult = canvas.toDataURL("image/webp").startsWith("data:image/webp")
      return cachedResult
    } catch {
      cachedResult = false
      return cachedResult
    }
  }
})()

const getResizeDimensions = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const loadImageSource = async (file: File) => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (context: CanvasRenderingContext2D, width: number, height: number) => {
          context.drawImage(bitmap, 0, 0, width, height)
        },
        cleanup: () => {
          bitmap.close()
        },
      }
    } catch {
      // Fallback below.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("La optimización de imágenes solo puede ejecutarse en el navegador")
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = "async"
  image.src = objectUrl

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("No se pudo cargar la imagen"))
  })

  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    draw: (context: CanvasRenderingContext2D, width: number, height: number) => {
      context.drawImage(image, 0, 0, width, height)
    },
    cleanup: () => {
      URL.revokeObjectURL(objectUrl)
    },
  }
}

const canvasToBlob = async (canvas: HTMLCanvasElement, mimeType: OptimizedImageMimeType, quality: number) => {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mimeType, quality)
  })

  if (!blob) {
    throw new Error("No se pudo convertir la imagen optimizada")
  }

  return blob
}

export const optimizeImage = async (file: File, options: OptimizeImageOptions): Promise<OptimizedImageResult> => {
  if (typeof document === "undefined") {
    throw new Error("La optimización de imágenes solo puede ejecutarse en el navegador")
  }

  const source = await loadImageSource(file)
  const dimensions = getResizeDimensions(source.width, source.height, options.maxWidth, options.maxHeight)
  const canvas = document.createElement("canvas")
  canvas.width = dimensions.width
  canvas.height = dimensions.height

  const context = canvas.getContext("2d")
  if (!context) {
    source.cleanup()
    throw new Error("No se pudo preparar el lienzo para la imagen")
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  source.draw(context, dimensions.width, dimensions.height)

  try {
    const webpSupported = await canEncodeWebP()
    const preferredMimeType: OptimizedImageMimeType = webpSupported ? "image/webp" : "image/jpeg"
    const preferredBlob = await canvasToBlob(canvas, preferredMimeType, options.quality)

    if (preferredMimeType === "image/webp") {
      return {
        blob: preferredBlob,
        mimeType: "image/webp",
        width: dimensions.width,
        height: dimensions.height,
      }
    }

    return {
      blob: preferredBlob,
      mimeType: "image/jpeg",
      width: dimensions.width,
      height: dimensions.height,
    }
  } catch {
    const fallbackBlob = await canvasToBlob(canvas, "image/jpeg", Math.min(options.quality, 0.9))
    return {
      blob: fallbackBlob,
      mimeType: "image/jpeg",
      width: dimensions.width,
      height: dimensions.height,
    }
  } finally {
    source.cleanup()
  }
}
