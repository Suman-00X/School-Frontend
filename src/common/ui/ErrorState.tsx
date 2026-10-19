import { useState } from "react";
import { Copy, Lock, SearchX, ServerCrash, WifiOff } from "lucide-react";
import { isApiError } from "@/common/api";
import { Button, ButtonLink } from "./Button";
import { EmptyState } from "./Feedback";

export function NoAccess({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={<Lock />}
      title="You don't have access to this"
      message={message ?? "Ask your school administrator if you need it."}
      actions={<ButtonLink to="/">Go home</ButtonLink>}
    />
  );
}

export function NotFound({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={<SearchX />}
      title="Not found"
      message={message ?? "This record does not exist or is not visible to you."}
      actions={<ButtonLink to="/">Go home</ButtonLink>}
    />
  );
}

/* What to show when a query fails: 403 and 404 get their own panels, the rest a retry */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);
  if (isApiError(error)) {
    if (error.status === 403) return <NoAccess message={error.message} />;
    if (error.status === 404) return <NotFound />;
    if (error.status < 500)
      return <EmptyState icon={<ServerCrash />} title="Couldn't load this" message={error.message} actions={onRetry && <Button onClick={onRetry}>Try again</Button>} />;
    return (
      <EmptyState
        icon={<ServerCrash />}
        title="Something went wrong"
        message={error.requestId ? <span className="mono">Request id: {error.requestId}</span> : undefined}
        actions={
          <>
            {onRetry && <Button onClick={onRetry}>Try again</Button>}
            {error.requestId && (
              <Button
                variant="ghost"
                icon={<Copy />}
                onClick={() => {
                  void navigator.clipboard?.writeText(error.requestId!);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy id"}
              </Button>
            )}
          </>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={<WifiOff />}
      title="Can't reach the server"
      message="Check your connection and try again."
      actions={onRetry && <Button onClick={onRetry}>Try again</Button>}
    />
  );
}
