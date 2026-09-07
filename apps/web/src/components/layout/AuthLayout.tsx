/** Shared shell for Login/Signup: a branded panel (materialos_brand_assets'
 * login artwork) on wide screens, the real form on top of a plain
 * background everywhere else. The artwork is decorative only -- the
 * functional form is always our own component, never baked into the image. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div
        className="hidden w-1/2 shrink-0 bg-brand-navy bg-cover bg-left lg:block"
        style={{ backgroundImage: "url(/brand/login-artwork.png)" }}
      >
        <div className="flex h-full flex-col items-start justify-between p-10">
          <img src="/brand/logo-dark.png" alt="MaterialOS" className="h-8 w-auto" />
          <p className="max-w-sm text-sm text-brand-navy-muted">
            One connected operating system for cement, steel, and every other material your business moves.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-secondary/30 p-4">
        {children}
      </div>
    </div>
  );
}
