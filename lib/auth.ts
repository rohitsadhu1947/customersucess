import { jwtVerify, SignJWT, type JWTPayload } from "jose"
import { cookies } from "next/headers"

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required")
  }
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

export interface AuthPayload extends JWTPayload {
  userId: string
  email: string
  name: string
  role: string
  companyId?: string
  companyName?: string
}

export async function verifyAuth(): Promise<AuthPayload> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")

  if (!token) {
    throw new Error("No token provided")
  }

  const { payload } = await jwtVerify(token.value, getSecret())
  return payload as AuthPayload
}

export async function createToken(
  payload: Omit<AuthPayload, "iat" | "exp">,
  expirationTime: string = "24h",
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(getSecret())
}

export { getSecret }
