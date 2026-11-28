import { demoModeEnabled } from "@/server/identity/auth/demo";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/**
 * Acceso a la instancia. Server-side para decidir si el botón del demo
 * existe (`DEMO_MODE=on`): sin la bandera el formulario es el de siempre y
 * no se le ofrece a nadie entrar sin registro.
 */
export default function LoginPage() {
  return <LoginForm demoEnabled={demoModeEnabled()} />;
}
