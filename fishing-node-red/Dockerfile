# Pinned so a rebuild does not silently move to a new major Node-RED release.
FROM nodered/node-red:5.0.10
USER root
COPY flows.json settings.js /opt/fishing/
RUN cd /opt/fishing && npm install --omit=dev --no-audit --no-fund mongodb@6 csv-parse@5
COPY start.sh /usr/local/bin/start-fishing.sh
# Strip CRLF in case the file was checked out on Windows.
RUN sed -i 's/\r$//' /usr/local/bin/start-fishing.sh && chmod +x /usr/local/bin/start-fishing.sh && chown -R node-red:node-red /opt/fishing
USER node-red
ENTRYPOINT ["/usr/local/bin/start-fishing.sh"]
