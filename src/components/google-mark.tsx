/** Google's logo keeps Google's own colours (their brand rule); it is the one place raw hex is allowed. */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.5v5.4h7.1c4.2-3.8 6.5-9.5 6.5-15.9z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.4c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.6C8.1 41.3 15.5 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.4c-.4-1.3-.7-2.7-.7-4.4s.3-3 .7-4.4v-5.6H4.5C3 17 2 20.4 2 24s1 7 2.5 10l7.3-5.6z" />
      <path fill="#EA4335" d="M24 10.6c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.7 4.5 14l7.3 5.6c1.7-5.2 6.5-9 12.2-9z" />
    </svg>
  );
}
