import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <section style={{ maxWidth: "36rem" }}>
        <p className="eyebrow">CAIOS Access Control</p>
        <h1>This newsroom action is restricted.</h1>
        <p>Your account is authenticated, but its assigned role does not permit this action. Contact a CAIOS administrator rather than sharing credentials or attempting to bypass the approval workflow.</p>
        <Link href="/">Return to the command center</Link>
      </section>
    </main>
  );
}
