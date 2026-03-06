import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type AppHeaderProps = {
  centerTitle?: string;
  children?: ReactNode;
};

export default function AppHeader({ centerTitle, children }: AppHeaderProps) {
  return (
    <header
      data-app-header
      className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b-[0.5px] border-(--nodi-blue-border) bg-(--nodi-blue) px-4 py-0.5"
    >
      <Link to="/" className="flex items-center gap-1.5">
        <img src="/nodeland-white.png" className="h-12 mb-1" />
        <span className="text-3xl font-semibold text-white">NodeLand</span>
      </Link>

      {centerTitle ? (
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 px-2">
          <h1 className="truncate text-3xl text-white font-semibold text-center">
            {centerTitle}
          </h1>
        </div>
      ) : null}

      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
