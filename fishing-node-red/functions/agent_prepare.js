msg.method='POST';msg.url='http://agent:3000/chat';msg.headers={'Content-Type':'application/json'};msg.payload={message:msg.payload?.message,history:msg.payload?.history||[]};return msg;
