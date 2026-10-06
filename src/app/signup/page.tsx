import { redirect } from "next/navigation";

// Sign-up is closed for now - this app is just for its owner.
export default function SignupPage() {
  redirect("/login");
}
