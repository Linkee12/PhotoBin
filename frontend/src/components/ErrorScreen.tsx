import type { CupleError } from "@cuple/react";
import { useNavigate } from "react-router";
import { PrimaryButton } from "../pages/Home/Home";
import { describeError } from "../utils/describeError";
import { StatusButtonLabel, StatusLink, StatusScreen } from "./StatusScreen";

/**
 * What a `<Boundary>` shows when something nobody handled failed: what went
 * wrong in plain words, Try again (which refetches only what failed) and a
 * way home.
 */
export function ErrorScreen(props: { error: CupleError; onRetry: () => void }) {
  const navigate = useNavigate();
  const { title, text } = describeError(props.error);
  return (
    <StatusScreen title={title} text={text}>
      <PrimaryButton type="button" onClick={props.onRetry} autoFocus>
        <StatusButtonLabel>Try again</StatusButtonLabel>
      </PrimaryButton>
      <StatusLink type="button" onClick={() => navigate("/")}>
        Go back home
      </StatusLink>
    </StatusScreen>
  );
}
