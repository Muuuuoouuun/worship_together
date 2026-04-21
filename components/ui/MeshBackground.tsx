"use client";

import React from 'react';

const MeshBackground: React.FC = () => {
    return (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(21,62,59,0.08),transparent_32%,rgba(198,106,69,0.09)_68%,transparent)]" />
            <div className="absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(90deg,rgba(21,62,59,0.16)_0,rgba(21,62,59,0.16)_1px,transparent_1px,transparent_68px),repeating-linear-gradient(0deg,rgba(21,62,59,0.12)_0,rgba(21,62,59,0.12)_1px,transparent_1px,transparent_68px)]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(255,253,248,0.9))]" />
        </div>
    );
};

export default MeshBackground;
