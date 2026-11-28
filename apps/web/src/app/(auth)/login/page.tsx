import { pruebaModeEnabled } from "@/server/identity/auth/prueba";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/**
 * Acceso a la instancia. Server-side para decidir si el botón «Entrar sin
 * registro» existe (`PRUEBA_MODE=on`, legacy `DEMO_MODE=on`): sin la bandera
 * el formulario es el de siempre y no se le ofrece a nadie entrar sin
 * registro.
 */
export default function LoginPage() {
  return <LoginForm pruebaEnabled={pruebaModeEnabled()} />;
}
