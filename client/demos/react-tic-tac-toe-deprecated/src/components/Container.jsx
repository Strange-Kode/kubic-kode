import { Box } from "@chakra-ui/react";

const Container = ({
  children,
  bg = "white",
  p = 4,
  borderRadius = "md",
  shadow = "sm",
  w = "100%",
  ...props
}) => {
  return (
    <Box
      p={p}
      bg={bg}
      borderRadius={borderRadius}
      shadow={shadow}
      w={w}
      {...props}
    >
      {children}
    </Box>
  );
};

export default Container;
