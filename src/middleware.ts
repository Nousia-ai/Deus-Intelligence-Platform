import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // Si las variables de auth no están configuradas en Vercel todavía, pasar sin bloquear
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refrescar sesión sin causar loops
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Si no está autenticado y no está en /login → redirigir a login
  if (!user && !pathname.startsWith("/login")) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    return NextResponse.redirect(loginUrl)
  }

  // Si ya está autenticado y va a /login → redirigir al dashboard
  if (user && pathname.startsWith("/login")) {
    const inicioUrl = request.nextUrl.clone()
    inicioUrl.pathname = "/inicio"
    return NextResponse.redirect(inicioUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Proteger todo excepto assets estáticos y rutas internas de Next.js
    "/((?!_next/static|_next/image|favicon.ico|deus-logo.svg|data/).*)",
  ],
}
