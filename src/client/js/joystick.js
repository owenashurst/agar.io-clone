var joystick = function(){
	var tempScreenPositionX;
	var tempDragPositionX;
	var tempScreenPositionY;
	var tempDragPositionY;
	var pressed = 0; //boolean
	var stickLength = 10;	
	var box = [0,0,0,0]; //upper left corner coords and lower right coords in which the box joystick can be used
	
	return{
		setStickLength: function(pLength){
			stickLength = pLength;
		},		
		setBox: function(pX1,pY1,pX2,pY2){
			box = [pX1,pY1,pX2,pY2];
		},
		getValue: function(){
			if(pressed == 1){
				var length = Math.sqrt(Math.pow((tempDragPositionX - tempScreenPositionX),2)+Math.pow((tempDragPositionY - tempScreenPositionY),2));
				if (length > stickLength){
					length = stickLength;
				}
				var power = (length/stickLength);			
				var radians = Math.atan2((tempDragPositionX - tempScreenPositionX), (tempDragPositionY - tempScreenPositionY));
				return [power,radians];
			}else{
				return [0,0];
			}
		},
		press: function(x,y){
			
			if(x>box[0] && x<box[2]){
				if(y>box[1] && y<box[3]){
					pressed = 1;
					tempScreenPositionX = x;
					tempScreenPositionY = y;
					tempDragPositionX = x;
					tempDragPositionY = y;
				}
			}
		},
		unpress: function(){
			pressed = 0;
		},
		updatePosition: function(x,y){
			if(pressed == 1){
				tempDragPositionX = x;
				tempDragPositionY = y;
			}
		},
		draw: function(ctx){
			if (pressed == 1){	
				//base of joystick
				var grd = context.createRadialGradient(tempScreenPositionX-25, tempScreenPositionY-25, 25, tempScreenPositionX+25, tempScreenPositionY+25, 25);
				grd.addColorStop(0, "#8ED6FF"); // light blue
   				grd.addColorStop(1, "#004CB3"); // dark blue  	
   						
				context.fillStyle = grd;				
				context.beginPath();
				//draw arc: arc(x, y, radius, startAngle, endAngle, anticlockwise)
				context.arc(tempScreenPositionX, tempScreenPositionY, 25, Math.PI*2, 0, true);
				//end drawing
				context.closePath()
				//fill it so you could see it
				context.fill();
	
				//actual joystick
				var grd2 = context.createRadialGradient(tempDragPositionX-15, tempDragPositionY-15, 15, tempDragPositionX+15, tempDragPositionY+15, 15);				
				grd2.addColorStop(0, "#FF9999"); // light red
   				grd2.addColorStop(1, "#990000"); // dark red 				
				context.fillStyle = grd2;				
				context.beginPath();
				//draw arc: arc(x, y, radius, startAngle, endAngle, anticlockwise)
				context.arc(tempDragPositionX, tempDragPositionY, 15, Math.PI*2, 0, true);
				//end drawing
				context.closePath()
				//fill it so you could see it
				context.fill();
			}	
		}
	}
};

