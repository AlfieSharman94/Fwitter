// Lets the API client tell the auth context that the session is gone (expired token,
// suspension, deleted account) so the router gate reacts immediately instead of
// waiting for the next app launch.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionLost(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishSessionLost(): void {
  listeners.forEach((l) => l());
}
