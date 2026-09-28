const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({
    server,
    path: "/ws"
});

let camera = null;
let viewers = new Set();

app.get("/", (req, res) => {
    res.send("ESP32-CAM Relay is running");
});

app.get("/status", (req, res) => {
    res.json({
        cameraConnected:
            camera !== null &&
            camera.readyState === WebSocket.OPEN,

        viewers:
            viewers.size
    });
});


wss.on("connection", (ws) => {

    console.log("WebSocket connection received");

    let role = null;


    ws.on("message", (data, isBinary) => {

        // ------------------------------------------------
        // BINARY DATA
        // Camera -> Viewers
        // ------------------------------------------------

        if (isBinary) {

            if (role === "camera") {

                for (const viewer of viewers) {

                    if (
                        viewer.readyState ===
                        WebSocket.OPEN
                    ) {

                        viewer.send(data);

                    }

                }

            }

            return;
        }


        // ------------------------------------------------
        // TEXT DATA
        // ------------------------------------------------

        const message =
            data.toString();


        // -----------------------------------------------
        // CAMERA IDENTIFICATION
        // -----------------------------------------------

        if (
            !role &&
            message === "CAMERA"
        ) {

            role = "camera";

            camera = ws;

            console.log(
                "ESP32-CAM connected"
            );

            ws.send("CAMERA_OK");

            // Tell existing viewers that camera is online

            for (const viewer of viewers) {

                if (
                    viewer.readyState ===
                    WebSocket.OPEN
                ) {

                    viewer.send(
                        JSON.stringify({
                            type: "camera_status",
                            connected: true
                        })
                    );

                }

            }

            return;
        }


        // -----------------------------------------------
        // VIEWER IDENTIFICATION
        // -----------------------------------------------

        if (
            !role &&
            message === "VIEWER"
        ) {

            role = "viewer";

            viewers.add(ws);

            console.log(
                "Viewer connected"
            );

            ws.send("VIEWER_OK");

            // Tell viewer whether camera exists

            ws.send(
                JSON.stringify({
                    type: "camera_status",
                    connected:
                        camera !== null &&
                        camera.readyState ===
                        WebSocket.OPEN
                })
            );

            return;
        }


        // -----------------------------------------------
        // VIEWER -> CAMERA CONTROL
        // -----------------------------------------------

        if (
            role === "viewer" &&
            camera !== null &&
            camera.readyState ===
            WebSocket.OPEN
        ) {

            try {

                const command =
                    JSON.parse(message);

                if (
                    command.type ===
                    "camera_settings"
                ) {

                    console.log(
                        "Camera settings:",
                        command
                    );

                    camera.send(
                        JSON.stringify(command)
                    );

                }

            } catch (error) {

                console.log(
                    "Invalid viewer command:",
                    message
                );

            }

        }

    });


    // ------------------------------------------------
    // CONNECTION CLOSED
    // ------------------------------------------------

    ws.on("close", () => {

        if (role === "camera") {

            console.log(
                "ESP32-CAM disconnected"
            );

            if (camera === ws) {
                camera = null;
            }


            // Tell viewers

            for (const viewer of viewers) {

                if (
                    viewer.readyState ===
                    WebSocket.OPEN
                ) {

                    viewer.send(
                        JSON.stringify({
                            type:
                                "camera_status",
                            connected: false
                        })
                    );

                }

            }

        }


        if (role === "viewer") {

            console.log(
                "Viewer disconnected"
            );

            viewers.delete(ws);

        }

    });


    ws.on("error", (error) => {

        console.log(
            "WebSocket error:",
            error.message
        );

    });

});


server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Relay server running on port ${PORT}`
        );

    }
);