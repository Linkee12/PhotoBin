/* eslint-disable react/no-unescaped-entities */
import { useNavigate } from "react-router";
import { StatusButtonLabel, StatusScreen } from "../../components/StatusScreen";
import { PrimaryButton } from "../Home/Home";

/** Shown for an album that does not exist (any more) and for unknown routes. */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      title="This album doesn't exist"
      text="It may have expired, been deleted, or the link is wrong."
    >
      <PrimaryButton type="button" onClick={() => navigate("/")}>
        <StatusButtonLabel>Go back home</StatusButtonLabel>
      </PrimaryButton>
    </StatusScreen>
  );
}
