/**
 * Charity Cloud — app shell.
 *
 * Routes by role after sign-in: donor → needs feed + matches; caseworker/
 * orgAdmin → charity console; moderator → moderation queue; platformOps →
 * approvals + metrics. Accessibility is a P0 feature: semantic landmarks,
 * labelled controls, visible focus, no colour-only state.
 */
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./auth/SignInForm";
import { ProfileSetup } from "./auth/ProfileSetup";
import { DonorHome } from "./donor/DonorHome";
import { CharityConsole } from "./charity/CharityConsole";
import { ModerationQueue } from "./moderation/ModerationQueue";
import { OpsConsole } from "./ops/OpsConsole";
import { Header } from "./components/Header";

export default function App() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <Unauthenticated>
        <main id="main" className="mx-auto max-w-md px-4 py-12">
          <h1 className="text-2xl font-bold">Charity Cloud</h1>
          <p className="mt-1 text-stone-600">
            Give what's needed, nearby. Charities post verified needs; neighbours within ~5km
            offer the item; handover happens at a neutral point.
          </p>
          <SignInForm />
        </main>
      </Unauthenticated>
      <Authenticated>
        <SignedInApp />
      </Authenticated>
    </div>
  );
}

function SignedInApp() {
  const me = useQuery(api.users.me);
  if (me === undefined) {
    return (
      <p role="status" className="p-8 text-stone-600">
        Loading…
      </p>
    );
  }
  if (me === null) return <ProfileSetup />;
  return (
    <>
      <Header me={me} />
      <main id="main" className="mx-auto max-w-3xl px-4 py-6">
        {me.role === "donor" && <DonorHome />}
        {(me.role === "caseworker" || me.role === "orgAdmin") && <CharityConsole me={me} />}
        {me.role === "moderator" && <ModerationQueue />}
        {me.role === "platformOps" && <OpsConsole />}
      </main>
    </>
  );
}
