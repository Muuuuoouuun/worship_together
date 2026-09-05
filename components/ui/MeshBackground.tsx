import React from 'react';

const MeshBackground: React.FC = () => {
    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background" />
    );
};

export default MeshBackground;
