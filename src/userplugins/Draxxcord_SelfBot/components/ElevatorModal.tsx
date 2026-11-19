import { Button } from "@components/Button";
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../style.css";

import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { TextInput, useState } from "@webpack/common";

import { targetElevator } from "../utils/targetElevator";

function ElevatorModal({ modalProps }: { modalProps: ModalProps; }) {
    const [iterations, setIterations] = useState("10");

    const handleRun = () => {
        const count = parseInt(iterations, 10);
        if (!isNaN(count) && count > 0) {
            targetElevator(count);
            modalProps.onClose();
        }
    };

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader separator={false} className="selfbot-modal-header">
                <h3>Target Elevator</h3>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent className="selfbot-modal-content">
                <h3 style={{ marginBottom: "8px" }}>Number of Loops</h3>
                <TextInput
                    type="number"
                    value={iterations}
                    onChange={setIterations}
                    placeholder="Enter number (e.g. 10)"
                    autoFocus
                />
                <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                    <Button onClick={handleRun} disabled={!iterations || isNaN(parseInt(iterations)) || parseInt(iterations) <= 0}>
                        Start Elevator
                    </Button>
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

export function openElevatorModal() {
    openModal(props => <ElevatorModal modalProps={props} />);
}
