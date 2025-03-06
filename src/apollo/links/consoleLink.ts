import {ApolloLink} from '@apollo/client';

export const consoleLink = new ApolloLink((operation, forward) => {
  console.log(`Starting request for ${operation.operationName}`);
  return forward(operation).map(data => {
    console.log(`Ending request for ${operation.operationName}`);
    return data;
  });
});
