import React from 'react';

const MeshBackground: React.FC = () => {
    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
            <div className="absolute -top-[15%] -left-[10%] h-[45vw] w-[45vw] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute top-[25%] -right-[15%] h-[40vw] w-[40vw] rounded-full bg-secondary/8 blur-3xl" />
            <div className="absolute -bottom-[15%] left-[20%] h-[35vw] w-[35vw] rounded-full bg-accent/5 blur-3xl" />
        </div>
    );
};

export default MeshBackground;
