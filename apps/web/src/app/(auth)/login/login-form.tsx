"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth/client";
import { siguienteSeguro } from "@/lib/oauth-next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Formulario de acceso. La página (`page.tsx`) es server-side y le pasa si
 * esta instancia tiene el acceso de prueba encendido (`PRUEBA_MODE`, legacy
 * `DEMO_MODE`): sin la bandera, el botón no se pinta y la instancia queda
 * igual que siempre.
 */
export function LoginForm({ pruebaEnabled }: { pruebaEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pruebaError, setPruebaError] = useState<string | null>(null);
  const [pruebaLoading, setPruebaLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signIn.email({ email, password });
    setLoading(false);
    if (err) {
      setError(
        err.status === 429
          ? "Demasiados intentos. Espera unos minutos."
          : "Correo o contraseña incorrectos."
      );
      return;
    }
    // 069 — Si el login lo pidió el OAuth del MCP, se vuelve a su pantalla de
    // consentimiento (solo rutas propias de `/oauth/`: no es un redireccionador).
    const next = siguienteSeguro(new URLSearchParams(window.location.search).get("next") ?? undefined);
    if (next) {
      window.location.assign(next);
      return;
    }
    // A la raíz, no a la Bandeja: ahí se decide si toca la guía de inicio
    // (#86) o la Bandeja de siempre.
    router.push("/");
    router.refresh();
  }

  async function entrarSinRegistro() {
    setPruebaError(null);
    setPruebaLoading(true);
    try {
      const res = await fetch("/api/prueba/sesion", { method: "POST" });
      if (!res.ok) {
        setPruebaError(
          res.status === 404
            ? "El acceso de prueba no está disponible en esta instancia."
            : res.status === 409
              ? "Esta instancia ya tiene su organización. Entra con tu cuenta."
              : res.status === 429
                ? "Demasiados intentos. Espera unos minutos."
                : "No se pudo entrar sin registro."
        );
        return;
      }
      // A la raíz, igual que un login normal: ahí se decide la entrada.
      router.push("/");
      router.refresh();
    } catch {
      setPruebaError("No se pudo entrar sin registro.");
    } finally {
      setPruebaLoading(false);
    }
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Primera vez aquí?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Crear la cuenta inicial
            </Link>
          </p>
        </form>
        {pruebaEnabled && (
          <div className="mt-6 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={entrarSinRegistro}
              disabled={pruebaLoading}
            >
              {pruebaLoading ? "Preparando tu acceso…" : "Entrar sin registro"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Recorre el proceso completo sin crear cuenta: se inicializa la
              organización de esta instancia y sigues la guía como cualquier
              propietario. Pensado para pruebas.
            </p>
            {pruebaError && <p className="text-sm text-destructive">{pruebaError}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
