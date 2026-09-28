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

wss.on("connection", (ws) => {

    console.log("WebSocket connection received");

    let role = null;

    ws.on("message", (data, isBinary) => {

        // First message identifies the client
        if (!role) {

            if (!isBinary && data.toString() === "CAMERA") {

                role = "camera";
                camera = ws;

                console.log("ESP32-CAM connected");

                ws.send("CAMERA_OK");

                return;
            }

            if (!isBinary && data.toString() === "VIEWER") {

                role = "viewer";
                viewers.add(ws);

                console.log("Viewer connected");

                ws.send("VIEWER_OK");

                return;
            }
        }

        // Camera sends JPEG frames
        if (role === "camera") {

            if (isBinary) {

                for (const viewer of viewers) {

                    if (viewer.readyState === WebSocket.OPEN) {
                        viewer.send(data);
                    }

                }

            }

            return;
        }
    });

    ws.on("close", () => {

        if (role === "camera") {

            console.log("ESP32-CAM disconnected");

            if (camera === ws) {
                camera = null;
            }

        }

        if (role === "viewer") {

            console.log("Viewer disconnected");

            viewers.delete(ws);

        }

    });

    ws.on("error", (error) => {
        console.log("WebSocket error:", error.message);
    });

});

server.listen(PORT, "0.0.0.0", () => {

    console.log(`Relay server running on port ${PORT}`);

});