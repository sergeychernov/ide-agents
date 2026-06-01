import { useCallback, useState } from "react";
import hoverClasses from "./repoCardHover.module.css";

export function useRepoCardOpen() {
  const [pinned, setPinned] = useState(false);

  const togglePinned = useCallback(() => {
    setPinned((open) => !open);
  }, []);

  const cardClassName = pinned
    ? `${hoverClasses.card} ${hoverClasses.pinned}`
    : hoverClasses.card;

  return { cardClassName, togglePinned };
}
