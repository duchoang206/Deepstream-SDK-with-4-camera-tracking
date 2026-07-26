APP:= deepstream-4cam-tracker

CXX:= g++
SRCS:= src/main.cpp
OBJS:= $(SRCS:.cpp=.o)

CFLAGS+= `pkg-config --cflags gstreamer-1.0`
LIBS+= `pkg-config --libs gstreamer-1.0`

all: $(APP)

$(APP): $(OBJS)
	$(CXX) -o $(APP) $(OBJS) $(LIBS)

%.o: %.cpp
	$(CXX) -c -o $@ $(CFLAGS) $<

clean:
	rm -rf $(OBJS) $(APP)
