import { CircleQuestionMark } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "react-router-dom";

export default function UserManualButton() {
  return (
    <Button className="fixed bottom-8 right-5 bg-(--nodi-blue) text-white shadow-lg hover:bg-(--nodi-blue-border)">
      <Link
        to="https://docs.google.com/document/d/1WnwyyDkXnCE7Fo1mPMFa-WEcnMaPjlAXCcKu2iAdaY4/edit?usp=sharing"
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-1 items-center"
      >
        <CircleQuestionMark className="inline" /> Ver Manual
      </Link>
    </Button>
  );
}
