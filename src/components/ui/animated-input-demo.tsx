"use client";

import { useState } from "react";
import { AnimatedInput } from "@/components/ui/animated-input";

const AnimatedInputPreview = () => {
  const [value, setValue] = useState("");

  return (
    <AnimatedInput
      label="Email Address"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
};

export default AnimatedInputPreview;
