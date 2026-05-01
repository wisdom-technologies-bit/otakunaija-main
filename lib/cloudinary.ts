import { v2 as cloudinary } from "cloudinary"

let configured = false

export function getCloudinary() {
  if (!configured) {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME
    const key = process.env.CLOUDINARY_API_KEY
    const secret = process.env.CLOUDINARY_API_SECRET
    if (!cloud || !key || !secret) {
      throw new Error(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET env vars.",
      )
    }
    cloudinary.config({
      cloud_name: cloud,
      api_key: key,
      api_secret: secret,
      secure: true,
    })
    configured = true
  }
  return cloudinary
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
  )
}

export async function uploadImageBuffer(buffer: Buffer, folder = "otakunaija"): Promise<string> {
  const cl = getCloudinary()
  return new Promise<string>((resolve, reject) => {
    const stream = cl.uploader.upload_stream(
      { folder, resource_type: "image", overwrite: false, quality: "auto", fetch_format: "auto" },
      (error, result) => {
        if (error) return reject(error)
        if (!result?.secure_url) return reject(new Error("Cloudinary upload returned no URL"))
        resolve(result.secure_url)
      },
    )
    stream.end(buffer)
  })
}
