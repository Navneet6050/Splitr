"use client";

import { Authenticated } from "@/hooks/use-convex-query";
import React from "react";

const MainLayout = ({ children }) => {
  return (
    <Authenticated>
      <div className="container mx-auto mt-16 mb-16 px-4">{children}</div>
    </Authenticated>
  );
};

export default MainLayout;
